class Loader {
    constructor(elem) {
        this.elem = elem;
        this.subscribers = 0;
    }

    start() {
        if (!this.subscribers) {
            this.elem.classList.toggle('hidden', false);
        }

        this.subscribers++;
    }

    stop() {
        if (this.subscribers <= 0) return;

        this.subscribers--;

        if (!this.subscribers) {
            this.elem.classList.toggle('hidden', true);
        }
    }

    abort() {
        this.subscribers = 0;
        this.elem.classList.toggle('hidden', true);
    }

    get onLoading() {
        return this.subscribers > 0;
    }
}

export { Loader };