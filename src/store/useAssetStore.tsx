import {create} from 'zustand'

const useAssetStore = create((set) => ({
    isOpen: false,
    toggleDrawer: (isOpen: boolean): any => {
        set((state: any) => ({
            ...state,
            isOpen: isOpen

        }));
    }
}));
export  default useAssetStore