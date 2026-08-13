import  { useEffect, useState, useRef } from "react";
import { useDispatch } from "react-redux";
import { setHtmlContent } from "../../../features/menuBar/menuSlice";
import HtmlData from "./htmlData";
import { Pane } from "tweakpane";
import useGame from "../../../hooks/useGame";

export default function Info() {
    const editable = useGame((state: any) => state.editable);
    const selectedAssetId = useGame((state: any) => state.selectedAssetId);
    const setHtmlData = useGame((state: any) => state.setHtmlData);
    const dispatch = useDispatch();
    const [infoData, setInfoData] = useState<string>("");
    const paneRef = useRef<Pane | null>(null);

    useEffect(() => {
        const fetchHtmlData = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/notes/${selectedAssetId}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                const notes = data?.notes || "";
                dispatch(setHtmlContent(notes));
                setInfoData(notes);
                setHtmlData(notes);
            } catch (error) {
                console.error("Failed to fetch asset info:", error);
                dispatch(setHtmlContent(""));
                setInfoData("");
                setHtmlData("");
            }
        };

        if (selectedAssetId) {
            fetchHtmlData();
        } else {
            dispatch(setHtmlContent(""));
            setInfoData("");
            setHtmlData("");
        }
    }, [dispatch, selectedAssetId, setHtmlData]);

    useEffect(() => {
        if (!editable || paneRef.current) return; // Prevent multiple instances

        const pane: any = new Pane();
        paneRef.current = pane;

        const folder = pane.addFolder({ title: "Info" });

        folder.addBlade({
            view: "text",
            label: "Content",
            value: infoData || "",
            parse: (v: any) => String(v), // Ensures value is always treated as a string
        }).on("change", (e: any) => {
            setHtmlData(e.value);
            setInfoData(e.value);
        });

        return () => pane.dispose(); // Cleanup on unmount
    }, [editable]);

    // return editable ? (
    //     <Editor value={infoData} onTextChange={(e) => setHtmlData(e.htmlValue)} style={{ height: "8rem" }} />
    // ) : (
    //     <HtmlData />
    // );
    return <HtmlData />
}
