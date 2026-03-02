export function initResizer() {
    const resizer = document.getElementById('resizer');
    const requestBuilder = document.getElementById('requestBuilder');
    const workspace = requestBuilder.parentElement;

    if (!resizer || !requestBuilder) return;

    let startY = 0;
    let startHeight = 0;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startY = e.clientY;
        startHeight = requestBuilder.getBoundingClientRect().height;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const delta = e.clientY - startY;
        const workspaceHeight = workspace.getBoundingClientRect().height;
        const minHeight = 160;
        const maxHeight = workspaceHeight - 120; // leave room for response

        const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + delta));
        requestBuilder.style.height = newHeight + 'px';
    }

    function onMouseUp() {
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}
