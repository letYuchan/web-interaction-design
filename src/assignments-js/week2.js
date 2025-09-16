const createImgButton = document.querySelector(".createImg");
const imgContainer = document.querySelector(".imgSection");
const buildingSelector = document.getElementById("buildingSelector");

let buildingName = buildingSelector.value;

const changeBuildingName = (e) => {
  buildingName = e.target.value;
};

const createImgToggle = () => {
  if (imgContainer.hasChildNodes()) {
    imgContainer.removeChild(imgContainer.childNodes[0]);
    return;
  }
  const img = document.createElement("img");
  img.src = `${
    buildingName
      ? buildingName === "davinci"
        ? "../assets/week2-handsome.png"
        : "../assets/week2-ugly.png"
      : "../assets/week2-handsome.png"
  }`;
  img.alt = "placeholder image";
  img.classList.add(
    "mt-4",
    "w-[400px]",
    "h-[400px]",
    "rounded-3xl",
    "border",
    "border-gray-300",
    "p-4",
    "bg-gray-400",
    "hover:opacity-70",
    "object-cover"
  );
  imgContainer.appendChild(img);
};
createImgButton.addEventListener("click", createImgToggle);
buildingSelector.addEventListener("change", changeBuildingName);
