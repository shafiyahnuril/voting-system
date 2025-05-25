module.exports = {
    webpack: {
      configure: (webpackConfig) => {
        // Cari dan modifikasi aturan CSS untuk mengecualikan node_modules/tailwindcss
        const cssRule = webpackConfig.module.rules.find(
          (rule) => rule.oneOf && Array.isArray(rule.oneOf)
        );
  
        if (cssRule && cssRule.oneOf) {
          cssRule.oneOf.forEach((rule) => {
            if (
              rule.test &&
              rule.test.toString().includes('.css') &&
              rule.use && 
              Array.isArray(rule.use)
            ) {
              // Tambahkan pengecualian untuk tailwindcss
              if (!rule.exclude) rule.exclude = [];
              if (Array.isArray(rule.exclude)) {
                rule.exclude.push(/node_modules\/tailwindcss/);
              }
            }
          });
        }
  
        return webpackConfig;
      },
    },
  };