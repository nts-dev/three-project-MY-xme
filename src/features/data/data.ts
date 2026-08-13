import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

interface Data {
    notes: string;
}
// Define a service using a base URL and expected endpoints
export const threeApi = createApi({
    reducerPath: 'threeApi',
    baseQuery: fetchBaseQuery({ baseUrl: `${import.meta.env.VITE_API_URL}/` }), // Ensure the environment variable is correctly set
    endpoints: (builder) => ({
        getData: builder.query<Data, string>({
            query: (extension) => `${extension}`,
        }),
    }),
});

// Export hooks for usage in functional components
export const { useGetDataQuery } = threeApi;

