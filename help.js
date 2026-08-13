const searchInput = document.getElementById("helpSearch");
const categoryCards = [...document.querySelectorAll(".category-card")];
const faqItems = [...document.querySelectorAll(".faq-item")];

document.querySelectorAll(".faq-question").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".faq-item");
    const willOpen = !item.classList.contains("open");

    item.classList.toggle("open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
});

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    categoryCards.forEach((card) => {
      const haystack = `${card.textContent} ${card.dataset.keywords || ""}`.toLowerCase();
      card.classList.toggle("hidden", Boolean(query) && !haystack.includes(query));
    });

    faqItems.forEach((item) => {
      const haystack = `${item.textContent} ${item.dataset.keywords || ""}`.toLowerCase();
      const match = !query || haystack.includes(query);

      item.classList.toggle("hidden", !match);

      if (query && match) {
        item.classList.add("open");
        item.querySelector(".faq-question")?.setAttribute("aria-expanded", "true");
      }

      if (!query) {
        item.classList.remove("open");
        item.querySelector(".faq-question")?.setAttribute("aria-expanded", "false");
      }
    });
  });
}

// Smooth-open FAQ when a category/anchor is selected.
window.addEventListener("hashchange", openHashTarget);
window.addEventListener("DOMContentLoaded", openHashTarget);

function openHashTarget() {
  if (!location.hash) return;

  const target = document.querySelector(location.hash);
  if (!target || !target.classList.contains("faq-item")) return;

  target.classList.add("open");
  target.querySelector(".faq-question")?.setAttribute("aria-expanded", "true");
}
