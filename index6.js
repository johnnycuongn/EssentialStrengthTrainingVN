const fs = require("fs");
const axios = require("axios");
const { parse, HTMLElement } = require("node-html-parser");
const cliProgress = require("cli-progress");

// Configuration
const config = {
  inputFile: "chapter1.html",
  outputFile: "public/translated.html",
  englishFile: "public/english.html",
  llmServer: "http://localhost:8080/v1/chat/completions",
  chunkSize: 2000, // Number of characters per chunk
  progressBarTheme: cliProgress.Presets.shades_grey,
  translationPrompt: (text) => `
  Translate into Vietnamese. Do not add any prefixes/suffixes. Focus on:
    - Natural and academic Vietnamese syntax
    - Consistency with previous translations
    - Technical accuracy

    Text to translate:
    ${text}
  `.trim()
};

// Inject a system prompt into every translation request so the LLM “persona” is a healthcare translation expert
axios.interceptors.request.use(request => {
  if (request.data && Array.isArray(request.data.messages)) {
    request.data.messages.unshift({
      role: "system",
      content: `
      You are a professional translator specializing in sports science literature.
      Texts are from book, use reference it: Essentials of Strength Training and Conditioning" by Dr. Bill Finkbeiner
      - **Task**: Translate from English to Vietnamese.
      - **Requirements**:
      1. Use formal Vietnamese suitable for academic texts.
      2. NEVER add explanations, notes, or formatting symbols.
      3. Do not retain markdown formatting (e.g., **bold**, *italics*, """) if present.
      4. Output ONLY the translated Vietnamese text. Do not add any prefixes or suffixes
     `
    });
  }
  return request;
});
/**
 * Translate text using LLM server
 */
async function translateText(text) {
  try {
    const response = await axios.post(
      config.llmServer,
      {
        messages: [
          {
            role: "user",
            content: config.translationPrompt(text),
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Translation error:", error.response?.data || error.message);
    return text; // Fallback to original text
  }
}

function parseHTML(inputFile) {
  const htmlContent = fs.readFileSync(inputFile, "utf8");
  const root = parse(htmlContent, {
    lowerCaseTagName: false,
    comment: false,
    script: true,
    style: true,
    voidTag: {
      area: true,
      base: true,
      br: true,
      col: true,
      command: true,
      embed: true,
      hr: true,
      img: true,
      keygen: true,
      link: true,
      meta: true,
      param: true,
      source: true,
      track: true,
      wbr: true,
    },
  });

  // Find and remove all image elements
  // Find and remove all image elements
  const images = root.querySelectorAll("img");
  console.log(`Found ${images.length} images in HTML`);

  // Try different removal methods to ensure images are removed
  // images.forEach((img) => {
  //   if (img.parentNode) {
  //     img.parentNode.removeChild(img);
  //   } else {
  //     img.remove();
  //   }
  // });

  // // Also look for image elements that might be in different formats
  // const imageElements = root.querySelectorAll('.pc svg, .pc image, [src*=".jpg"], [src*=".png"], [src*=".gif"]');
  // console.log(`Found ${imageElements.length} additional image-like elements`);
  // imageElements.forEach(el => el.remove());

  // Find all image elements
  const imageElements = root.querySelectorAll("img");

  // Remove classes and set width to 100px for each image
  imageElements.forEach((img) => {
    // Remove all classes
    img.removeAttribute("class");
    // Set width to 100px
    img.setAttribute("style", "width: 100px;");
  });

  // Also handle other image-like elements
  const otherImageElements = root.querySelectorAll(
    'svg, image, [src*=".jpg"], [src*=".png"], [src*=".gif"]'
  );
  console.log(
    `Processing ${otherImageElements.length} additional image-like elements`
  );
  otherImageElements.forEach((el) => {
    el.removeAttribute("class");
    el.setAttribute("style", "width: 100px;");
  });

  console.log(`Processing HTML file: ${inputFile}`);
  // Find all elements with class "PC"
  const pcElements = root.querySelectorAll(".pc");

  console.log(`Found ${pcElements.length} PC elements.`);
  const pcProgressBar = new cliProgress.SingleBar({}, config.progressBarTheme);
  pcProgressBar.start(pcElements.length, 0);

  pcElements.forEach((pc, index) => {
    // Find all child divs with class "t m0" within this PC container
    const tElements = pc.querySelectorAll("div.t");
    console.log(
      `Found ${tElements.length} div.t to combine in div.pc element ${
        index + 1
      }.`
    );
    if (tElements.length > 0) {
      // Combine the text content of these t elements
      let combinedHTML = [];
      let currentParagraph = "<p>";
      tElements.forEach((t_el, index) => {
        if (index === 0) return;
        if (index === 1) {
          if (!isNaN(t_el.textContent.trim()) && t_el.textContent.trim() !== "") {
            combinedHTML.push(`<h2 class="no-translate">-------------Trang ${t_el.text}-------------------</h2>`);
            return;
          }
        }

        const spans = t_el.querySelectorAll("span");
        if (spans.length > 0) {
          spans.forEach((span) => {
            span.replaceWith(span.textContent);
          });
        }

        const headings = ["ff134", "ff40", "ff45", "ff6"];
        if (headings.some((heading) => t_el.classList.contains(heading))) {
          console.log("Found heading class", t_el.textContent);
          currentParagraph += "</p>";
          combinedHTML.push(currentParagraph);
          currentParagraph = "<p>";

          combinedHTML.push(`<h3>${t_el.textContent}</h3>`);
          return;
        }

        const nextParagraph = ["x3", "x18", "x1d"];
        if (nextParagraph.some((next) => t_el.classList.contains(next))) {
        console.log("Found x18 or x1d class", t_el.textContent);
          currentParagraph += "</p>";
          combinedHTML.push(currentParagraph);
          currentParagraph = `<p> ${t_el.textContent}`;
          return;
        }

        currentParagraph += `${t_el.textContent}` + " ";
      });

      if (currentParagraph.length !== 0 && currentParagraph.startsWith("<p>")) {
        currentParagraph += "</p>";
        combinedHTML.push(currentParagraph);
      }

      const newCombinedDiv = parse(
        `<div>${combinedHTML.join("")}</div>`
      ).firstChild;

      tElements.forEach((div) => div.remove());

      // Append the new combined div.
      // If the order matters, you might choose to insert it where the first original div was located.
      // For simplicity, here we append it at the end.
      pc.appendChild(newCombinedDiv);
      pcProgressBar.update(index + 1);
    }
  });

  pcProgressBar.stop();
  console.log(`Processed ${pcElements.length} PC elements.`);

  // Remove all styling from head
  const head = root.querySelector("head");
  if (head) {
    // Remove all style tags
    head.querySelectorAll("style").forEach((style) => style.remove());
    head
      .querySelectorAll('link[rel="stylesheet"], link[href*=".css"]')
      .forEach((link) => link.remove());
    head.querySelectorAll("script").forEach((script) => script.remove());

    console.log("Removed styling from head element.");
  }

  // Find page container and style it
  const pageContainer = root.querySelector("#page-container");
  if (pageContainer) {
    pageContainer.setAttribute(
      "style",
      "margin: 0 auto; padding: 16px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;"
    );
  }

  // Remove loading-indicator
  const loadingIndicator = root.querySelector(".loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.remove();
  }

  return root;
}

/**
 * Process HTML chunks asynchronously while preserving structure
 */
async function translateHTML(inputFilePath, outputFilePath) {
  const root = parseHTML(inputFilePath);

  // Extract all text nodes that need translation
  const elementsToTranslate = [];
  root.querySelectorAll("*").forEach((element) => {
    if (
      element.childNodes.length === 1 &&
      element.childNodes[0].nodeType === 3 &&
      !element.classList.contains("no-translate")
    ) {
      elementsToTranslate.push(element); // Only translate plain text nodes
    }
  });
  fs.writeFileSync(config.englishFile, root.toString(), "utf8");

  const totalElements = elementsToTranslate.length;
  console.log(`Found ${totalElements} elements to translate.`);

  // Initialize CLI progress bar
  const progressBar = new cliProgress.SingleBar({}, config.progressBarTheme);
  progressBar.start(totalElements, 0);

  // Translate each element sequentially in chunks
  // Helper function to check if an element is within the body tag
  function isWithinBody(element) {
    let current = element;
    while (current && current.tagName && current.tagName.toLowerCase() !== "html") {
      if (current.tagName.toLowerCase() === "body") {
        return true;
      }
      if (!current || !current.parentNode) {
        return false;
      }
      current = current.parentNode;
    }
    return false;
  }

  for (let i = 0; i < totalElements; i++) {
    const element = elementsToTranslate[i];


    if (root.querySelector("html") && !isWithinBody(element)) {
      progressBar.update(i + 1);
      continue;
    }

    const originalText = element.text.trim();
    if (originalText) {
      let translatedText = await translateText(originalText);
      translatedText = translatedText.replace(/<\|eot_id\|>/g, "");
      element.set_content(translatedText);
    }
    progressBar.update(i + 1);
  }

  progressBar.stop();

  // Ensure proper HTML structure and save the translated file
  fs.writeFileSync(outputFilePath, root.toString(), "utf8");
  console.log(
    `Translation complete! Translated file saved as: ${outputFilePath}`
  );
}

// Execute translation
(async () => {
  await translateHTML(config.inputFile, config.outputFile);
})();
