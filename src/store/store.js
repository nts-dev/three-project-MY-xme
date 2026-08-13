import { configureStore } from '@reduxjs/toolkit'
import menuReducer from '../features/menuBar/menuSlice'
import {threeApi} from "../features/data/data";
import nodeReducer from '../features/videoNodes/nodeSlice';

export default configureStore({
    reducer: {
        menu: menuReducer,
        [threeApi.reducerPath]: threeApi.reducer,
        node: nodeReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(threeApi.middleware),
})

