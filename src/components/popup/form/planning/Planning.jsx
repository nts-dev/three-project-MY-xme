import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import PlanningContent from "./PlanningContent";
import useGame from "../../../../hooks/useGame";

export default function Planning({ id, planningTab }) {
    const setLogs = useGame((state) => state.setLogs);
    const refreshPlanning = useGame((state) => state.refreshPlanning);
    const selectedAssetId = useGame((state) => state.selectedAssetId);

    const getPlanning = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getPlanning/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            const logList = data.map(dto => ({
                eventId: dto.event_id,
                id: dto.id,
                name: dto.event_name,
                details: dto.details,
                enteredBy: dto.entered_by,
                assignedTo: dto.assigned_eid,
                startDate: dto.start_date,
                endDate: dto.end_date,
                freq: dto.event_length,
                variable:dto.is_variable,
                reoccur_map: dto.reoccur_map,
                period: dto.duration,
                rec_type:dto.rec_type,
                info: dto.info,
                approved_by: dto.approved_by,
                map: dto.map,





            }));

            setLogs(logList);

            // Check if planning container already exists
            let planningContainer = document.getElementById("planning-container");

            if (!planningContainer) {
                planningContainer = document.createElement("div");
                planningContainer.id = "planning-container";
                planningTab.element.appendChild(planningContainer);
            }

            // Clear previous content before rendering new one
            planningContainer.innerHTML = "";

            createRoot(planningContainer).render(
                <PlanningContent key={`${selectedAssetId}_planning`} />
            );

        } catch (error) {
            console.error("Failed to fetch documents:", error);
        }
    };

    useEffect(() => {
        getPlanning();
    }, [id, refreshPlanning,planningTab]);

    return null;
}
