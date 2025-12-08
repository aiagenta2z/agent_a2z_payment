function initializeGlobalConfig() {
    const currentHost = window.location.host;

    const isLocal = currentHost.includes('localhost')
        || currentHost.includes('127.0.0.1')
        || currentHost.includes(':5000')
        || currentHost.includes(':700');

    return {
        productionUrlPrefix: isLocal ? "/a2z_payment_agent_sandbox" : "/a2z_payment_agent_sandbox"
    }
}
