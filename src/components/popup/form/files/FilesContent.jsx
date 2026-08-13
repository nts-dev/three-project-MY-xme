import React from "react";
import FileTable from "./FileTable";
import { ThemeProvider, createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});
export default function FilesContent() {

    return (
        <ThemeProvider key='files' theme={darkTheme}>
            <FileTable key='file-table'/>
        </ThemeProvider>
    )
}