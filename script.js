/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const WORKER_URL = "https://loreal-chatbot.vpreap1.workers.dev/";
let allProducts = [];
let currentProducts = [];
let selectedProductIds = [];
let generatedRoutine = "";
const chatMessages = [
  {
    role: "assistant",
    content:
      "Hi! Ask me about products or tell me what kind of routine you want to build.",
  },
];

/* Load saved selections from the browser */
loadSavedSelections();

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

renderChat();
renderSelectedProducts();
updateGenerateButtonState();
initializeProducts();

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  productsContainer.innerHTML = products
    .map(
      (product) => {
        const isSelected = selectedProductIds.includes(product.id);

        return `
    <article
      class="product-card ${isSelected ? "selected" : ""}"
      data-product-id="${product.id}"
      tabindex="0"
      role="button"
      aria-pressed="${isSelected}"
    >
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <div>
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
        </div>
        <div class="product-actions">
          <button
            type="button"
            class="description-toggle"
            data-description-toggle="${product.id}"
            aria-expanded="false"
          >
            View description
          </button>
          <div class="product-description" id="description-${product.id}" hidden>
            ${product.description}
          </div>
        </div>
      </div>
      <span class="selection-badge">${isSelected ? "Selected" : "Tap to select"}</span>
    </article>
  `;
      },
    )
    .join("");
}

/* Load saved product selections from localStorage */
function loadSavedSelections() {
  const savedSelections = localStorage.getItem("selectedProductIds");

  if (!savedSelections) {
    selectedProductIds = [];
    return;
  }

  try {
    selectedProductIds = JSON.parse(savedSelections);
  } catch (error) {
    selectedProductIds = [];
  }
}

/* Save product selections to localStorage */
function saveSelections() {
  localStorage.setItem("selectedProductIds", JSON.stringify(selectedProductIds));
}

/* Find a product by id */
function getProductById(productId) {
  return allProducts.find((product) => product.id === productId);
}

/* Return all selected products as full product objects */
function getSelectedProducts() {
  return selectedProductIds
    .map((productId) => getProductById(productId))
    .filter(Boolean);
}

/* Keep only the product fields the chatbot actually needs */
function getSelectedProductsForPrompt() {
  return getSelectedProducts().map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

/* Update the selected products panel */
function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message selected-placeholder">
        No products selected yet.
      </div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item" data-selected-product-id="${product.id}">
          <div class="selected-product-label">
            <span class="selected-product-icon" aria-hidden="true">
              <i class="fa-solid fa-bag-shopping"></i>
            </span>
            <strong>${product.name}</strong>
            <p>${product.brand}</p>
          </div>
          <button type="button" class="remove-product-btn" data-remove-product="${product.id}">
            Remove
          </button>
        </div>
      `,
    )
    .join("");
}

/* Highlight the selected cards and update button text */
function syncProductCardSelectionState() {
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach((card) => {
    const productId = Number(card.dataset.productId);
    const isSelected = selectedProductIds.includes(productId);

    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));

    const badge = card.querySelector(".selection-badge");
    if (badge) {
      badge.textContent = isSelected ? "Selected" : "Tap to select";
    }
  });
}

/* Enable or disable the routine button */
function updateGenerateButtonState() {
  generateRoutineButton.disabled = selectedProductIds.length === 0;
}

/* Toggle a product selection on or off */
function toggleProductSelection(productId) {
  const selectedIndex = selectedProductIds.indexOf(productId);

  if (selectedIndex >= 0) {
    selectedProductIds.splice(selectedIndex, 1);
  } else {
    selectedProductIds.push(productId);
  }

  saveSelections();
  renderSelectedProducts();
  syncProductCardSelectionState();
  updateGenerateButtonState();
}

/* Remove a product from the saved selection */
function removeSelectedProduct(productId) {
  selectedProductIds = selectedProductIds.filter(
    (selectedId) => selectedId !== productId,
  );

  saveSelections();
  renderSelectedProducts();
  syncProductCardSelectionState();
  updateGenerateButtonState();
}

/* Clear all selected products */
function clearSelectedProducts() {
  selectedProductIds = [];
  generatedRoutine = "";
  saveSelections();
  renderSelectedProducts();
  syncProductCardSelectionState();
  updateGenerateButtonState();
}

/* Build the system prompt that gives the worker context */
function buildSystemMessage() {
  const selectedProducts = getSelectedProductsForPrompt();

  if (generatedRoutine) {
    return {
      role: "system",
      content: `You are a helpful beauty advisor. Keep your answers focused on this routine and the user's selected products. Selected products JSON: ${JSON.stringify(
        selectedProducts,
      )}. Generated routine: ${generatedRoutine}`,
    };
  }

  if (selectedProducts.length > 0) {
    return {
      role: "system",
      content: `You are a helpful beauty advisor. Use only these selected products to build the routine. Selected products JSON: ${JSON.stringify(
        selectedProducts,
      )}`,
    };
  }

  return {
    role: "system",
    content:
      "You are a helpful beauty advisor. Answer routine and product questions clearly and briefly.",
  };
}

/* Ask the worker for an AI response */
async function getChatResponse(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      selectedProducts: getSelectedProductsForPrompt(),
    }),
  });

  if (!response.ok) {
    throw new Error("Chat request failed");
  }

  const data = await response.json();

  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  if (data?.response) {
    return data.response;
  }

  if (data?.message) {
    return data.message;
  }

  return "Sorry, I could not get a response right now.";
}

/* Load and show the first product set if a category is chosen */
async function initializeProducts() {
  const products = await loadProducts();
  const selectedCategory = categoryFilter.value;

  if (selectedCategory) {
    const filteredProducts = products.filter(
      (product) => product.category === selectedCategory,
    );
    displayProducts(filteredProducts);
  }

  renderSelectedProducts();
  syncProductCardSelectionState();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
  syncProductCardSelectionState();
});

/* Toggle product selection and description visibility from the product grid */
productsContainer.addEventListener("click", (e) => {
  const descriptionButton = e.target.closest(".description-toggle");

  if (descriptionButton) {
    e.stopPropagation();

    const productId = Number(descriptionButton.dataset.descriptionToggle);
    const description = document.getElementById(`description-${productId}`);
    const expanded = descriptionButton.getAttribute("aria-expanded") === "true";

    descriptionButton.setAttribute("aria-expanded", String(!expanded));
    description.hidden = expanded;
    descriptionButton.textContent = expanded ? "View description" : "Hide description";
    return;
  }

  const card = e.target.closest(".product-card");

  if (!card) {
    return;
  }

  toggleProductSelection(Number(card.dataset.productId));
});

productsContainer.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") {
    return;
  }

  const card = e.target.closest(".product-card");

  if (!card) {
    return;
  }

  e.preventDefault();
  toggleProductSelection(Number(card.dataset.productId));
});

/* Remove a selected product or clear the whole list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-product-btn");

  if (!removeButton) {
    return;
  }

  removeSelectedProduct(Number(removeButton.dataset.removeProduct));
});

clearSelectionsButton.addEventListener("click", () => {
  clearSelectedProducts();
});

/* Generate a routine from only the selected products */
generateRoutineButton.addEventListener("click", async () => {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    chatMessages.push({
      role: "assistant",
      content: "Please select at least one product before generating a routine.",
    });
    renderChat();
    return;
  }

  const routineRequest = `Create a personalized routine using only these selected products. Return a simple morning or evening routine, explain the order, and keep it focused on the product list below. Selected products JSON: ${JSON.stringify(
    getSelectedProductsForPrompt(),
  )}`;

  chatMessages.push({ role: "user", content: "Generate a routine from my selected products." });
  chatMessages.push({ role: "assistant", content: "Thinking..." });
  renderChat();

  try {
    const reply = await getChatResponse([
      buildSystemMessage(),
      ...chatMessages.filter((message) => message.content !== "Thinking..."),
      { role: "user", content: routineRequest },
    ]);

    generatedRoutine = reply;
    chatMessages[chatMessages.length - 1].content = reply;
  } catch (error) {
    chatMessages[chatMessages.length - 1].content =
      "Sorry, I could not generate a routine right now.";
  } finally {
    renderChat();
  }
});

/* Render chat messages in the chat window */
function renderChat() {
  chatWindow.innerHTML = chatMessages
    .map((message) => {
      const bubbleClass =
        message.role === "user"
          ? "chat-message user"
          : "chat-message assistant";
      const speaker = message.role === "user" ? "You" : "L'Oréal Advisor";

      return `
        <div class="${bubbleClass}">
          <strong>${speaker}:</strong>
          <span>${message.content}</span>
        </div>
      `;
    })
    .join("");

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();

  if (!userMessage) {
    return;
  }

  chatMessages.push({ role: "user", content: userMessage });
  chatMessages.push({ role: "assistant", content: "Thinking..." });

  userInput.value = "";
  userInput.disabled = true;
  renderChat();

  try {
    const reply = await getChatResponse(
      [buildSystemMessage(), ...chatMessages.filter((message) => message.content !== "Thinking...")],
    );

    chatMessages[chatMessages.length - 1].content = reply;
  } catch (error) {
    chatMessages[chatMessages.length - 1].content =
      "Sorry, the chatbot is not available right now.";
  } finally {
    userInput.disabled = false;
    userInput.focus();
    renderChat();
  }
});
