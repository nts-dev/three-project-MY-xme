import { createSlice } from '@reduxjs/toolkit';

const projectFilesSlice = createSlice({
    name: 'projectFiles',
    initialState: {
    },
    reducers: {
        clear: () => ({}),
        setState: (state, action) => {
            return action.payload || {};
        }
    }
});

export default projectFilesSlice;
