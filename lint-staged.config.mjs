export default {
  "*.{mjs,js,ts,vue,json,html}": [
    (files) => `nx format:write --files=${files.join(",")}`,
  ],
};
