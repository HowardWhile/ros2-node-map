import "@lumino/default-theme/style/index.css";
import "./styles.css";
import "./workbench/workbench.css";
import { bootstrap } from "./workbench/bootstrap";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
bootstrap(root);
