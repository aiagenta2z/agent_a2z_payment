document.addEventListener('DOMContentLoaded', function() {

    const collapseBtn = document.querySelector('.collapse-btn');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    // sidebar other places click, collapse 

    const appContainer = document.querySelector(".app-container");
    if (appContainer != null) {
        const sidebar = document.querySelector('.sidebar');

        appContainer.addEventListener('click', (e) => {

            const isClickInsideSidebar = sidebar && sidebar.contains(e.target);
            const isClickOnMenuBtn = collapseBtn && collapseBtn.contains(e.target);

            const isSideCollapsed = sidebar.classList.contains("collapsed");

            if (!isSideCollapsed && !isClickInsideSidebar && !isClickOnMenuBtn && sidebar) {
                // collapse the sidebard
                sidebar.classList.toggle('collapsed');
            }
        });
    }

});
