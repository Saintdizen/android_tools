window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
               const theme = event.matches ? "dark" : "light";
               console.log(theme)
           });