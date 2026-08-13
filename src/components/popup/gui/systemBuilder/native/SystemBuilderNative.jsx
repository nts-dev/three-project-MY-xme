import React, { useEffect, useMemo, useState } from "react";
import {
    getSystemBuilderDetail,
    getSystemBuilderMenu,
    getSystemBuilderProductGroups,
} from "./systemBuilderApi";
import SystemBuilderNativePreview from "./SystemBuilderNativePreview";
import SystemBuilderNativeProductTable from "./SystemBuilderNativeProductTable";
import SystemBuilderNativeSidebar from "./SystemBuilderNativeSidebar";
import SystemBuilderNativeSummary from "./SystemBuilderNativeSummary";
import { getSelectedItems } from "./systemBuilderUtils";
import "./SystemBuilderNative.css";

export default function SystemBuilderNative({ systemId = 200, onFallback }) {
    const [menu, setMenu] = useState(null);
    const [detail, setDetail] = useState(null);
    const [groups, setGroups] = useState([]);
    const [focusedProduct, setFocusedProduct] = useState(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                setStatus("loading");
                const [nextMenu, nextDetail, nextGroups] = await Promise.all([
                    getSystemBuilderMenu("nl"),
                    getSystemBuilderDetail(systemId),
                    getSystemBuilderProductGroups(systemId),
                ]);

                if (!cancelled) {
                    setMenu(nextMenu);
                    setDetail(nextDetail);
                    setGroups(nextGroups);
                    setFocusedProduct(nextGroups[0]?.products?.find((product) => product.defaultSelected) || nextGroups[0]?.products?.[0] || null);
                    setStatus("ready");
                }
            } catch (error) {
                console.warn("Native system builder load failed:", error);
                if (!cancelled) setStatus("error");
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [systemId]);

    const selectedItems = useMemo(() => getSelectedItems(groups), [groups]);
    const total = useMemo(() => (
        selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
    ), [selectedItems]);

    if (status === "loading") {
        return <div className="sb-native-status">Loading system builder...</div>;
    }

    if (status === "error") {
        return (
            <div className="sb-native-status">
                <strong>Unable to load native System Builder.</strong>
                <button type="button" onClick={onFallback}>Use iframe fallback</button>
            </div>
        );
    }

    return (
        <div className="sb-native">
            <nav className="sb-native-nav" aria-label="System builder navigation">
                <span />
                <button type="button">Over Ons</button>
                <button type="button">Produkten</button>
                <button type="button">Services</button>
                <button type="button">Verkoop</button>
            </nav>
            <div className="sb-native-hero">
                <div className="sb-native-hero__image" />
                <SystemBuilderNativeSummary detail={detail} quantity={1} total={total} />
                <h1><span>System</span> Builder</h1>
            </div>
            <div className="sb-native-layout">
                <SystemBuilderNativeSidebar menu={menu} />
                <main className="sb-native-main">
                    <div className="sb-native-tabs">
                        <span>Show</span>
                        <button type="button" className="is-active">Products</button>
                        <button type="button">BOM list</button>
                    </div>
                    <SystemBuilderNativeProductTable groups={groups} onProductFocus={setFocusedProduct} />
                </main>
                <SystemBuilderNativePreview detail={detail} product={focusedProduct} />
            </div>
        </div>
    );
}
