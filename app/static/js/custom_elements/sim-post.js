customElements.define(
    "sim-post",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            this.contentTarget = document.querySelector(
                this.getAttribute("sim-post-target"),
            );
            this.content = this.querySelector("[sim-post-content]");
            this.addEventListener("click", (e) => {
                this.contentTarget.innerHTML = "";
                let insertedNode = this.content.cloneNode(true);
                insertedNode.firstElementChild.deserialise(
                    this.content.firstElementChild.serialise(),
                );
                this.contentTarget.insertAdjacentElement(
                    "afterbegin",
                    insertedNode,
                );
            });
        }
    },
);
