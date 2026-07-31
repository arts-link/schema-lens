import { createSchemaInspector } from "@schema-lens/overlay";

const inspector = createSchemaInspector({
  document,
  observeChanges: true,
});

const status = requiredElement<HTMLParagraphElement>("status");
const openButton = requiredElement<HTMLButtonElement>("open-inspector");
const addButton = requiredElement<HTMLButtonElement>("add-schema");
const modifyButton = requiredElement<HTMLButtonElement>("modify-schema");
const removeButton = requiredElement<HTMLButtonElement>("remove-schema");

openButton.addEventListener("click", () => {
  inspector.open();
  status.textContent = "Inspector opened.";
});

addButton.addEventListener("click", () => {
  const existing = document.querySelector("#dynamic-schema");
  if (existing) {
    status.textContent = "The dynamic JSON-LD script already exists.";
    return;
  }
  const script = document.createElement("script");
  script.id = "dynamic-schema";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@id": "#dynamic-product",
    "@type": "Product",
    name: "Dynamically added product",
    offers: {
      "@type": "Offer",
      price: "29.00",
      priceCurrency: "USD",
    },
  });
  document.head.append(script);
  status.textContent = "Added a Product and nested Offer.";
});

modifyButton.addEventListener("click", () => {
  const script = document.querySelector<HTMLScriptElement>("#main-schema");
  if (!script?.textContent) {
    status.textContent = "The main JSON-LD script is not available.";
    return;
  }
  const value = JSON.parse(script.textContent) as {
    "@graph": Array<Record<string, unknown>>;
  };
  const article = value["@graph"].find((entity) => entity["@id"] === "#article");
  if (article) {
    article["headline"] = `Updated at ${new Date().toLocaleTimeString()}`;
    article["dateModified"] = new Date().toISOString();
  }
  script.textContent = JSON.stringify(value, null, 2);
  status.textContent = "Updated the Article headline and dateModified.";
});

removeButton.addEventListener("click", () => {
  const dynamic = document.querySelector("#dynamic-schema");
  const target = dynamic ?? document.querySelector("#duplicate-two");
  if (!target) {
    status.textContent = "There are no removable example scripts left.";
    return;
  }
  const label = target.id === "dynamic-schema" ? "dynamic script" : "second duplicate";
  target.remove();
  status.textContent = `Removed the ${label}.`;
});

function requiredElement<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing example element #${id}.`);
  return value as T;
}
