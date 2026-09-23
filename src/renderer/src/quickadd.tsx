import React from "react"
import { createRoot } from "react-dom/client"
import { QuickAdd } from "./components/QuickAdd"
import "./styles.css"

createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<QuickAdd />
	</React.StrictMode>,
)
