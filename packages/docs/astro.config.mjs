import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
    integrations: [
        starlight({
            title: "WriteLynx",
            sidebar: [
                {
                    label: "Introdução",
                    items: ["index", "getting-started"]
                },
                {
                    label: "Uso",
                    items: [
                        "usage/javascript",
                        "usage/lua",
                        "usage/cli"
                    ]
                },
                {
                    label: "Integrações",
                    items: [
                        "integrations/luckymaker",
                        "integrations/proxy",
                        "integrations/lm"
                    ]
                },
                {
                    label: "Regras",
                    items: ["rules/schema", "rules/builtin", "rules/custom"]
                },
                {
                    label: "Validadores",
                    items: ["validators/mod11", "validators/luhn"]
                },
                "templates"
            ]
        })
    ]
});
