import { createSchemaInspector } from "../packages/overlay/src/index.js";

let inspector: ReturnType<typeof createSchemaInspector> | undefined;

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const trigger = event.target.closest<HTMLButtonElement>("[data-add-overlay]");
  if (!trigger) return;

  inspector ??= createSchemaInspector({ document });
  inspector.open();
  trigger.textContent = "Open the overlay";
});
