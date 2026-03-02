class UndoManager {
    constructor() {
        this.stack = [];
    }

    push({ description, execute }) {
        this.stack.push({ description, execute });
        if (this.stack.length > 50) this.stack.shift();
    }

    async undo() {
        if (!this.stack.length) {
            window.showToast('Nothing to undo', 'error');
            return;
        }
        const action = this.stack.pop();
        await action.execute();
    }
}

window.undoManager = new UndoManager();
