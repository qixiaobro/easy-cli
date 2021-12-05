#!/usr/bin/env node

import fs from "fs";
import path from "path";
import prompts from "prompts";
import minimist from "minimist";
import { yellow, green, cyan, blue, magenta, lightRed, red } from "kolorist";

const argv = minimist(process.argv.slice(2), { string: ["_"] });

const cwd = process.cwd();

const FRAMEWORKS = [
  {
    name: "vue",
    color: green,
    variants: [
      {
        name: "vue-admin-template-permission",
        display: "vue-admin-template-permission template have some presets",
        color: yellow,
      },
      // {
      //   name: "vue2",
      //   display: "Vue2 template have some presets",
      //   color: green,
      // },
      {
        name: "vue3-vite",
        display: "Vue3 & vite javascript template",
        color: cyan,
      },
      {
        name: "vue3-vite-ts",
        display: "Vue3 & vite typescript template",
        color: blue,
      },
      // {
      //   name: "vue2-vant-h5",
      //   display: "Vue2 & vant & javscript for h5  template",
      //   color: magenta,
      // },
      // {
      //   name: "vue3-vant-h5",
      //   display: "Vue3 & vant & typescript for h5  template",
      //   color: lightRed,
      // },
    ],
  },
  {
    name: "Native",
    color: yellow,
    variants: [
      {
        name: "native-h5",
        display: "native template",
        color: blue,
      },
      // {
      //   name: "jq-boostrap-v4",
      //   display: "jq & boostrap v4 native template",
      //   color: blue,
      // },
    ],
  },
];

const TEMPLATES = FRAMEWORKS.map(
  //模板名数组
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), []);

const renameFiles = {
  _gitignore: ".gitignore",
};

async function init() {
  let targetDir = argv._[0];
  let template = argv.template || argv.t;

  const defaultProjectName = !targetDir ? "easy-create-project" : targetDir;

  let result = {};
  try {
    result = await prompts(
      [
        {
          type: targetDir ? null : "text", //是否设置项目名
          name: "projectName",
          message: "Project name:",
          initial: defaultProjectName,
          onState: (state) =>
            (targetDir = state.value.trim() || defaultProjectName),
        },
        {
          //判断当前目录是否存在，且是否为空。覆盖
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : "confirm",
          name: "overwrite",
          message: () =>
            (targetDir === "."
              ? "Current directory"
              : `Target directory "${targetDir}"`) +
            ` is not empty. Remove existing files and continue?`,
        },
        {
          type: (prev) => {
            if (prev === false) {
              //不覆盖 退出
              throw new Error(red("✖") + " Operation cancelled");
            }
            return null;
          },
          name: "overwriteChecker",
        },
        {
          type: () => (isValidPackageName(targetDir) ? null : "text"),
          name: "packageName",
          message: "Package name:",
          initial: () => toValidPackageName(targetDir),
          validate: (dir) =>
            isValidPackageName(dir) || "Invalid package.json name",
        },
        {
          //选择框架
          type: template && TEMPLATES.includes(template) ? null : "select",
          name: "framework",
          message:
            typeof template === "string" && !TEMPLATES.includes(template)
              ? `"${template}" isn't a valid template. Please choose from below: `
              : "Select a framework:",
          initial: 0,
          choices: FRAMEWORKS.map((framework) => {
            const frameworkColor = framework.color;
            return {
              title: frameworkColor(framework.name),
              value: framework,
            };
          }),
        },
        {
          //选择模版
          type: (framework) =>
            framework && framework.variants ? "select" : null,
          name: "variant",
          message: "Select a variant:",
          choices: (framework) =>
            framework.variants.map((variant: any) => {
              const variantColor = variant.color;
              return {
                title: variantColor(variant.name),
                value: variant.name,
              };
            }),
        },
      ],
      {
        onCancel: () => {
          throw new Error(red("✖") + " Operation cancelled");
        },
      }
    );
  } catch (cancelled: any) {
    console.log(cancelled.message);
    return;
  }
  console.log(result);

  // @ts-ignore
  const { framework, overwrite, packageName, variant } = result;

  const root = path.join(cwd, targetDir);

  if (overwrite) {
    emptyDir(root);
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root);
  }

  template = variant || framework || template;

  console.log(`\nScaffolding project in ${root}...`);

  const templateDir = path.join(__dirname, `template-${template}`); //模版项目路径

  const write = (file: any, content: any) => {
    // @ts-ignore
    const targetPath = renameFiles[file]
      ? // @ts-ignore
        path.join(root, renameFiles[file])
      : path.join(root, file);
    if (content) {
      fs.writeFileSync(targetPath, content);
    } else {
      copy(path.join(templateDir, file), targetPath);
    }
  };

  const files = fs.readdirSync(templateDir);
  for (const file of files.filter((f) => f !== "package.json")) {
    write(file, false);
  }
  if (framework.name !== "Native") {
    const pkg = require(path.join(templateDir, `package.json`));

    pkg.name = packageName || targetDir;

    write("package.json", JSON.stringify(pkg, null, 2));

    const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent);
    const pkgManager = pkgInfo ? pkgInfo.name : "npm";

    console.log(`\nDone. Now run:\n`);
    if (root !== cwd) {
      console.log(`  cd ${path.relative(cwd, root)}`);
    }
    switch (pkgManager) {
      case "yarn":
        console.log("  yarn");
        console.log("  yarn dev");
        break;
      default:
        console.log(`  ${pkgManager} install`);
        console.log(`  ${pkgManager} run dev`);
        break;
    }
  }else{
     console.log(`\nDone. Now run:\n`);
     console.log(`  cd ${path.relative(cwd, root)}`);
  }

  function isEmpty(path: string) {
    //判断目录下是否为空
    return fs.readdirSync(path).length === 0;
  }

  function isValidPackageName(projectName: string) {
    //判断是否有效项目名
    return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
      projectName
    );
  }

  function toValidPackageName(projectName: string) {
    //转换项目名
    return projectName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^[._]/, "")
      .replace(/[^a-z0-9-~]+/g, "-");
  }

  function emptyDir(dir: string) {
    //清空文件夹
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const file of fs.readdirSync(dir)) {
      const abs = path.resolve(dir, file);
      if (fs.lstatSync(abs).isDirectory()) {
        //是文件夹
        emptyDir(abs);
        fs.rmdirSync(abs);
      } else {
        //文件
        fs.unlinkSync(abs);
      }
    }
  }

  function copy(src: string, dest: string) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  function copyDir(srcDir: string, destDir: string) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
      const srcFile = path.resolve(srcDir, file);
      const destFile = path.resolve(destDir, file);
      copy(srcFile, destFile);
    }
  }

  function pkgFromUserAgent(userAgent: any) {
    if (!userAgent) return undefined;
    const pkgSpec = userAgent.split(" ")[0];
    const pkgSpecArr = pkgSpec.split("/");
    return {
      name: pkgSpecArr[0],
      version: pkgSpecArr[1],
    };
  }
}

init().catch((e) => {
  console.error(e);
});
