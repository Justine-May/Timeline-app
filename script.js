const items = document.querySelectorAll('.container');

const checkScroll = () => {
    const triggerBottom = window.innerHeight / 5 * 4;

    items.forEach(item => {
        const itemTop = item.getBoundingClientRect().top;

        if(itemTop < triggerBottom) {
            item.classList.add('show');
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        } else {
            item.classList.remove('show');
            item.style.opacity = '0';
        }
    });
};

// Initial check
window.addEventListener('scroll', checkScroll);

// Add initial styles via JS or update CSS to support transition
items.forEach(item => {
    item.style.transition = 'all 0.5s ease';
    item.style.opacity = '0';
});
