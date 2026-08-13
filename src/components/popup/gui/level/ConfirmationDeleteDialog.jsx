import React, { useRef, useState,useMemo } from "react";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import "./../confirm.css";
import useGame from "../../../../hooks/useGame";
export default function ConfirmationDeleteDialog() {

    const setShowConfirmDelete = useGame((s) => s.setShowConfirmDelete);
    const showConfirmDelete = useGame((s) => s.showConfirmDelete);
    const selectedLevel = useGame((s) => s.selectedLevel);
    const setLazy = useGame((s) => s.setLazy);
    const setLevels = useGame((s) => s.setLevels);
    const levels = useGame((s) => s.levels);
    const projectID = useGame((s) => s.projectID);
    const setSelectedLevel = useGame((s) => s.setSelectedLevel);
  
      const baseProjectId = useMemo(() => String(projectID || "").split("_")[0], [projectID]);

    const toast = useRef(null);


    const accept = async () => {
        setLazy(true)
        try {
            const deletedCode = selectedLevel.code;
            // show loading toast (optional)
            toast.current?.show({
                severity: "warn",
                summary: "Deleting...",
                detail: `Deleting level ${deletedCode}...`,
                life: 1500,
            });

            // ✅ call API
            const res = await fetch(`${import.meta.env.VITE_API_URL}/game-delete-level`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_id: baseProjectId, // <- your selected project id
                    level: deletedCode,         // <- your selected level number
                }),
            });

            const data = await res.json();

            if (!res.ok || !data?.ok) {
                throw new Error(data?.message || `Delete failed (${res.status})`);
            }

            toast.current?.show({
                severity: "success",
                summary: "Deleted",
                detail: `Level ${level} deleted successfully`,
                life: 3000,
            });

      

      // find index of deleted level
      const index = levels.findIndex((l) => l.code === deletedCode);

      // remove it
      const updatedLevels = levels.filter((l) => l.code !== deletedCode);

      let nextSelected = null;

      if (updatedLevels.length > 0) {
        const prevIndex = index > 0 ? index - 1 : 0;
        nextSelected = updatedLevels[prevIndex];
      }
        setSelectedLevel(nextSelected);
         setLevels(updatedLevels);

       setLazy(false)

        } catch (err) {
            toast.current?.show({
                severity: "error",
                summary: "Error",
                detail: err?.message || "Failed to delete level",
                life: 4000,
            });
        } finally {
            setShowConfirmDelete(false); // close confirm dialog no matter what
        }
    };


    const reject = () => {
        toast.current?.show({
            severity: "warn",
            summary: "Rejected",
            detail: "You have rejected",
            life: 3000,
        });
        setShowConfirmDelete(false)  // Reset visibility after reject
    };

    return (
        <>
            <Toast ref={toast} />
            <ConfirmDialog

                visible={showConfirmDelete}
                closable={false}
                icon='pi pi-exclamation-triangle'
                className="game-dialog"
                message={`Delete Level ${selectedLevel?.name} ?`} 
                accept={accept}
                reject={reject}
                acceptLabel="YES"
                rejectLabel="NO"
                headerClassName={"game-header"}
                acceptClassName="p-button-sm game-btn"
                rejectClassName="p-button-sm game-btn"
            />
        </>
    );
}