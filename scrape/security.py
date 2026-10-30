import ipaddress
import socket
from urllib.parse import urlparse


class SsrfValidationError(ValueError):
    """Raised when a target URL fails SSRF security validation."""
    pass


restrictedIpNetworks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    # IPv4 Loopback
    ipaddress.ip_network("127.0.0.0/8"),
    # IPv4 Private networks
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    # IPv4 Link-local & Cloud Metadata (specifically AWS EC2/Lightsail 169.254.169.254)
    ipaddress.ip_network("169.254.0.0/16"),
    # IPv4 Carrier-grade NAT
    ipaddress.ip_network("100.64.0.0/10"),
    # IPv4 Current network / Broadcast / Multicast / Reserved
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6 Loopback & Unspecified
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("::/128"),
    # IPv6 Unique Local Address (ULA / private)
    ipaddress.ip_network("fc00::/7"),
    # IPv6 Link-Local
    ipaddress.ip_network("fe80::/10"),
    # IPv6 Multicast
    ipaddress.ip_network("ff00::/8"),
]

blockedHostnameSuffixes: tuple[str, ...] = (
    ".localhost",
    ".local",
    ".internal",
)


def isRestrictedIp(ipAddress: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Checks whether an IP address belongs to restricted, private, or loopback ranges."""
    targetIp = ipAddress
    if isinstance(targetIp, ipaddress.IPv6Address) and targetIp.ipv4_mapped:
        targetIp = targetIp.ipv4_mapped

    if (
        targetIp.is_private
        or targetIp.is_loopback
        or targetIp.is_link_local
        or targetIp.is_multicast
        or targetIp.is_reserved
        or targetIp.is_unspecified
    ):
        return True

    for restrictedNetwork in restrictedIpNetworks:
        if restrictedNetwork.version == targetIp.version and targetIp in restrictedNetwork:
            return True

    return False


def resolveHostIps(hostname: str) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """Resolves a hostname or IP string to a list of IPv4/IPv6 address objects."""
    cleanedHost = hostname.strip("[]")

    # 1. Direct IP address literal check (IPv4 or IPv6)
    try:
        ipObj = ipaddress.ip_address(cleanedHost)
        return [ipObj]
    except ValueError:
        pass

    # 2. Alternative IPv4 representation check (octal, hex, or integer)
    try:
        packedIp = socket.inet_aton(hostname)
        canonicalIp = socket.inet_ntoa(packedIp)
        return [ipaddress.ip_address(canonicalIp)]
    except (OSError, ValueError):
        pass

    # 3. Standard DNS resolution using socket.getaddrinfo (supports IPv4 and IPv6)
    try:
        addrInfoList = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        resolvedIps: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
        for addrInfo in addrInfoList:
            sockAddr = addrInfo[4]
            ipStr = sockAddr[0]
            ipObj = ipaddress.ip_address(ipStr)
            if ipObj not in resolvedIps:
                resolvedIps.append(ipObj)

        if not resolvedIps:
            raise SsrfValidationError(f"Could not resolve any IP address for hostname '{hostname}'.")
        return resolvedIps
    except socket.gaierror as dnsError:
        raise SsrfValidationError(f"DNS resolution failed for hostname '{hostname}': {dnsError}")


def validateTargetUrl(targetUrl: str) -> None:
    """Validates that a URL is safe for outbound scraping/fetching to prevent SSRF attacks.

    Args:
        targetUrl: The candidate URL string to validate.

    Raises:
        SsrfValidationError: If the scheme is invalid, host cannot be resolved,
            or resolved IP addresses point to private, loopback, link-local,
            or restricted networks.
    """
    if not targetUrl or not isinstance(targetUrl, str) or not targetUrl.strip():
        raise SsrfValidationError("Target URL must be a non-empty string.")

    cleanedUrl = targetUrl.strip()
    try:
        parsedUrl = urlparse(cleanedUrl)
    except Exception as parseError:
        raise SsrfValidationError(f"Invalid target URL structure: {parseError}")

    scheme = (parsedUrl.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise SsrfValidationError(
            f"Invalid URL scheme '{parsedUrl.scheme}'. Only 'http' and 'https' are allowed."
        )

    hostname = parsedUrl.hostname
    if not hostname or not hostname.strip():
        raise SsrfValidationError("Invalid target URL: missing hostname.")

    hostname = hostname.strip().lower()

    # Block obvious special hostnames without DNS lookup
    if hostname == "localhost" or any(hostname.endswith(suffix) for suffix in blockedHostnameSuffixes):
        raise SsrfValidationError(f"Access to local or internal hostname '{hostname}' is blocked.")

    # Validate port if explicitly present
    try:
        port = parsedUrl.port
        if port is not None and not (1 <= port <= 65535):
            raise SsrfValidationError(f"Invalid target URL port {port}. Port must be between 1 and 65535.")
    except ValueError as portError:
        raise SsrfValidationError(f"Invalid target URL port: {portError}")

    # Resolve hostname to all associated IP addresses
    resolvedIps = resolveHostIps(hostname)

    # Check each resolved IP address against restricted ranges
    for ipAddress in resolvedIps:
        if isRestrictedIp(ipAddress):
            raise SsrfValidationError(
                f"Target URL '{targetUrl}' resolves to restricted or private IP address '{ipAddress}'. Access blocked."
            )
