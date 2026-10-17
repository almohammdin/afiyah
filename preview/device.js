document
  .querySelectorAll("button")
  .forEach(
    (b) =>
      (b.onclick = () =>
        (document.getElementById("device").style.width =
          b.dataset.width + "px")),
  );
