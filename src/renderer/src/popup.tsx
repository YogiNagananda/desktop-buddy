import React from "react"
import { createRoot } from "react-dom/client"
import { ReminderPopup } from "./components/ReminderPopup"
import "./styles.css"

createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<ReminderPopup />
	</React.StrictMode>,
)
