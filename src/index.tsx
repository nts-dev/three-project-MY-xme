import ReactDOM from 'react-dom/client';
import './index.css';
import App from "./App";
import SocketController from "./socketControler";
import { Provider } from 'react-redux'
import store from "./store/store";
import {DndProvider} from "react-dnd";
import { HTML5Backend } from 'react-dnd-html5-backend';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

const dndProps: any = {
    backend: HTML5Backend,
    children: (
        <Provider store={store}>
            <SocketController />
            <App />
        </Provider>
    ),
};

root.render(<DndProvider {...dndProps} />);

