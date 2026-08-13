const accordionButtons = document.querySelectorAll(".accordion-button");

accordionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".accordion-item");
    const willOpen = !item.classList.contains("open");

    item.classList.toggle("open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
});

function openTargetFromHash() {
  if (!location.hash) return;

  const target = document.querySelector(location.hash);
  if (!target) return;

  // Jika hash diarahkan ke sebuah accordion item, buka item tersebut.
  if (target.classList.contains("accordion-item")) {
    target.classList.add("open");
    target.querySelector(".accordion-button")?.setAttribute("aria-expanded", "true");
  }

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

window.addEventListener("hashchange", openTargetFromHash);
window.addEventListener("DOMContentLoaded", openTargetFromHash);
