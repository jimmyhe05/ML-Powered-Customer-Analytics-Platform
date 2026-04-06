// Helper function to format feature names
export const formatFeatureName = (feature) => {
  // Remove prefix (num__, cat__, etc.)
  let formatted = feature.replace(/^(num__|cat__|bool__)/, "");

  // Replace underscores and dots with spaces
  formatted = formatted.replace(/[_.]/g, " ");

  // Split into words and capitalize each word
  formatted = formatted
    .split(" ")
    .map((word) => {
      // Special cases
      if (word.toUpperCase() === "SIM" || word.toUpperCase() === "ID") {
        return word.toUpperCase();
      }

      // Common replacements
      switch (word.toLowerCase()) {
        case "info":
          return "Info";
        case "num":
          return "#";
        case "email":
          return "Email";
        case "encoded":
          return "Code";
        default:
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    })
    .join(" ");

  // Handle long names by adding line breaks
  if (formatted.length > 20) {
    const words = formatted.split(" ");
    const midpoint = Math.ceil(words.length / 2);
    formatted =
      words.slice(0, midpoint).join(" ") +
      "\n" +
      words.slice(midpoint).join(" ");
  }

  return formatted;
};

