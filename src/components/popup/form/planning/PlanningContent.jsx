
import React from "react";

import { ThemeProvider, createTheme } from '@mui/material/styles';
import PlanningTable from "./PlanningTable";
import PlanningForm from "./PlanningForm";
import useGame from "../../../../hooks/useGame";

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});
export default function PlanningContent() {
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    return (
        <ThemeProvider key='planning' theme={darkTheme}>
             <PlanningTable key={`${selectedAssetId}_table`} />
             <PlanningForm key={`${selectedAssetId}_form`}/>
        </ThemeProvider>
    )
}