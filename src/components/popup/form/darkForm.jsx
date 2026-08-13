import React, { useEffect, useState } from 'react';
import WireInfo from './Form.jsx';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useGame from "../../../hooks/useGame";

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});
const DarkForm = ({scene}) => {
    const [hasEditorShell, setHasEditorShell] = useState(false);
    const editPopup = useGame((state) => state.editPopup);

    useEffect(() => {
        setHasEditorShell(Boolean(document.querySelector('.rogue-editor-shell')));
    }, []);

 
    if (hasEditorShell && !editPopup) {
        return null;
    }

    return (
        <ThemeProvider theme={darkTheme}>
            <WireInfo scene={scene} />
        </ThemeProvider>
    );
};

export default DarkForm;
