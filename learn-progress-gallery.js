document.querySelectorAll('.progress-gallery').forEach(gallery => {
    const buttons = [...gallery.querySelectorAll('button[aria-controls]')];
    buttons.forEach(button => button.addEventListener('click', () => {
        buttons.forEach(option => {
            const selected = option === button;
            option.setAttribute('aria-pressed', String(selected));
            document.getElementById(option.getAttribute('aria-controls')).hidden = !selected;
        });
    }));
});
