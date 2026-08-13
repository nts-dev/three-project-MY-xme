import { createSlice } from '@reduxjs/toolkit'
export const menuSlice = createSlice({
    name: 'menu',
    initialState: {
        walls: false,
        lights: false,
        sound: false,
        anims: false,
        playersList: false,
        playerRanks: true,
        info: false,
        isUserProfile: false,
        isMessage: false,
        htmlContent: "",
        // add more buttons as needed
    },
    reducers: {
        toggle: (state, action) => {
            const key = action.payload; // payload should be the button name (e.g., 'walls', 'lights', 'sound')
            if (key in state) {
                state[key] = !state[key];
            }
        },
        setHtmlContent: (state, action) => {
            state.htmlContent = action.payload; // Set the HTML content dynamically
        }
    },
})
export const { toggle, setHtmlContent} = menuSlice.actions
export default menuSlice.reducer

