import { useEffect, useRef, useState } from "react";
import { Pane } from "tweakpane";
import useGame from "../../../../hooks/useGame";
export default function PlanningForm() {
    const containerRef = useRef(null);
    const logs = useGame((state) => state.logs);
    const selectedLogIndex = useGame((state) => state.selectedLogIndex);
    const setLogFormData = useGame((state) => state.setLogFormData);
    const employees = useGame((state) => state.employees);

    // State to track form changes
    const [formState, setFormState] = useState({
        event_id: "",
        event_name	: "",
        details: "",
        enteredBy: "",
        assignedTo: "",
        start_date	: "",
        end_date: "",
    });

    const formatDateIn = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        const ss = String(date.getSeconds()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    };

    const getEventEmployee =  async (eventId) => {

        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/getEventEmployee/${eventId}`
            );
            const result = await response.json();

            return result[0]

        } catch (error) {
            console.error("Error deleting asset:", error);
            return  []

        }
    }

    const createForm = async (pane)=>{
        const formData = logs[selectedLogIndex];
        if (!formData) return;
        const employeeEvent = await getEventEmployee(formData.eventId)
        // console.log(employeeEvent)
        setFormState({
            event_id: formData.eventId.toString(),
            event_name: formData.name || "",
            details: formData.details || "",
            enteredBy: formData.enteredBy || "",
            assignedTo: formData.assignedTo || "",
            start_date: formatDateIn(formData.startDate) || "",
            end_date: formatDateIn(formData.endDate) || "",
            freq: formData.freq,
            variable:formData.variable,
            reoccur_map: formData.reoccur_map,
            period: formData.period,
            rec_type:formData.rec_type,
            info: formData.info,
            approved_by: formData.approved_by,
            map: formData.map,
        });



        // Event Name Field
        pane.addBlade({
            view: "text",
            label: "Event Name",
            parse: (v) => String(v),
            value: formData.name,
        }).on("change", (ev) => setFormState((prev) => ({ ...prev, event_name: ev.value })));

        // Custom Textarea for Details
        const binding = pane.addBlade({
            view: "text",
            label: "Details",
            parse: (v) => String(v),
            value: "",
        });

        const container = binding.controller.view.element;
        container.innerHTML = "";

        const label = document.createElement("div");
        label.textContent = "Details";
        label.classList.add("tweakpane-label");

        const textarea = document.createElement("textarea");
        textarea.classList.add("tweakpane-textarea");
        textarea.rows = 5;
        textarea.value = formData.details;
        textarea.addEventListener("input", (e) => {
            setFormState((prev) => ({ ...prev, details: e.target.value }));
        });

        container.appendChild(label);
        container.appendChild(textarea);

        // Dropdowns for Entered By & Assigned To
        pane.addBlade({
            view: "list",
            label: "Assigned To",
            options:employees,
            value: employeeEvent.employee_id,
        }).on("change", (ev) => setFormState((prev) => ({ ...prev, enteredBy: ev.value })));

        pane.addBlade({
            view: "list",
            label: "Approved By",
            options: employees,
            value: employees[49]?.value,
        }).on("change", (ev) => setFormState((prev) => ({ ...prev, assignedTo: ev.value })));

        // Start Date
        const dateBlade = pane.addBlade({
            view: "text",
            label: "Start DateTime",
            parse: (v) => String(v),
            value: formatDateIn(formData.startDate),
        }).on("change", (ev) => {
            const formattedDate = formatDateIn(ev.value); // Convert back to desired format
            setFormState((prev) => ({ ...prev, start_date: formattedDate }));
        });
// Change input type to datetime-local
        setTimeout(() => {
            const inputElement = dateBlade.controller.view.element.querySelector("input");
            if (inputElement) {

                inputElement.type = "datetime-local";
                inputElement.step = "60"; // Allows selecting minutes (adjust as needed)
            }
        }, 100);

        // End Date
        const endBlade = pane.addBlade({
            view: "text",
            label: "End DateTime",
            parse: (v) => String(v),
            value: formatDateIn(formData.endDate),
        }).on("change", (ev) => {
            const formattedDate = formatDateIn(ev.value); // Convert back to desired format
            setFormState((prev) => ({ ...prev, start_date: formattedDate }));
        });

        setTimeout(() => {
            const inputElement = endBlade.controller.view.element.querySelector("input");
            if (inputElement) {

                inputElement.type = "datetime-local";
                inputElement.step = "60"; // Allows selecting minutes (adjust as needed)
            }
        }, 100);
    }

    // Update state when selected log changes
    useEffect(() => {
        const pane = new Pane({ container: containerRef.current });

        createForm(pane)

        return () => pane.dispose();
    }, [selectedLogIndex, logs]);

    useEffect(() => {
        setLogFormData(formState)

    }, [formState]);

    return (
        <div key="planning-form" className="planning-form" ref={containerRef}></div>
    );
}
