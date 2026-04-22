/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const WORKER_URL = "https://loreal-chatbot.vpreap1.workers.dev/";
const chatMessages = [
  {
    role: "assistant",
    content:
      "Hi! Ask me about products or tell me what kind of routine you want to build.",
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

renderChat();

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Render chat messages in the chat window */
function renderChat() {
  chatWindow.innerHTML = chatMessages
    .map((message) => {
      const bubbleClass = message.role === "user" ? "chat-message user" : "chat-message assistant";
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

/* Send the conversation to the worker and return the assistant reply */
async function getChatResponse(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
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
      chatMessages.filter((message) => message.content !== "Thinking...")
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
