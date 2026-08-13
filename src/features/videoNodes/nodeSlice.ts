import { createSlice, PayloadAction } from '@reduxjs/toolkit';


const initialState: any = {
    nodes: [], // Initial empty nodes
};

const nodeSlice = createSlice({
    name: 'node',
    initialState,
    reducers: {
        setNodes(state, action: PayloadAction<any[]>) {
            state.nodes = action.payload;
        },
        updateNodeChildren(state, action: PayloadAction<{ key: string, children: any[] }>) {
            const { key, children } = action.payload;
            const findNodeByKey = (nodes: any[], nodeKey: string): any | null => {
                for (let node of nodes) {
                    if (node.key === nodeKey) return node;
                    if (node.children) {
                        const found = findNodeByKey(node.children, nodeKey);
                        if (found) return found;
                    }
                }
                return null;
            };
            const nodeToUpdate = findNodeByKey(state.nodes, key);
            if (nodeToUpdate) {
                nodeToUpdate.children = children;
            }
        },
    },
});
export const { setNodes, updateNodeChildren } = nodeSlice.actions;

export default nodeSlice.reducer;
