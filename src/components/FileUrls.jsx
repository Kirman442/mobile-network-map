import { useMemo } from 'react';

export const useParquetFileUrls = () => {
    return useMemo(() => {
        // const baseUrl = '/Gisco/optimized_data/binary/';
        const BASE_URL = 'https://raw.githubusercontent.com/Kirman442/deckgl/main/ookla/'
        return [
            // `${BASE_URL}albania_data_zstd10.parquet`,
            // `${BASE_URL}andorra_data_zstd10.parquet`,
            `${BASE_URL}austria_data_zstd10.parquet`,
            // `${BASE_URL}belgium_data_zstd10.parquet`,
            // `${BASE_URL}bosnia_and_herzegovina_data_zstd10.parquet`,
            // `${BASE_URL}bulgaria_data_zstd10.parquet`,
            // `${BASE_URL}croatia_data_zstd10.parquet`,
            // `${BASE_URL}cyprus_data_zstd10.parquet`,
            // `${BASE_URL}czechia_data_zstd10.parquet`,
            // `${BASE_URL}denmark_data_zstd10.parquet`,
            // `${BASE_URL}estonia_data_zstd10.parquet`,
            // `${BASE_URL}finland_data_zstd10.parquet`,
            `${BASE_URL}france_data_zstd10.parquet`,
            `${BASE_URL}germany_data_zstd10.parquet`,
            // `${BASE_URL}greece_data_zstd10.parquet`,
            // `${BASE_URL}hungary_data_zstd10.parquet`,
            `${BASE_URL}iceland_data_zstd10.parquet`,
            `${BASE_URL}ireland_data_zstd10.parquet`,
            `${BASE_URL}italy_data_zstd10.parquet`,
            // `${BASE_URL}latvia_data_zstd10.parquet`,
            `${BASE_URL}liechtenstein_data_zstd10.parquet`,
            // `${BASE_URL}lithuania_data_zstd10.parquet`,
            // `${BASE_URL}luxembourg_data_zstd10.parquet`,
            // `${BASE_URL}malta_data_zstd10.parquet`,
            // `${BASE_URL}montenegro_data_zstd10.parquet`,
            // `${BASE_URL}netherlands_data_zstd10.parquet`,
            // `${BASE_URL}north_macedonia_data_zstd10.parquet`,
            `${BASE_URL}norway_data_zstd10.parquet`,
            // `${BASE_URL}poland_data_zstd10.parquet`,
            // `${BASE_URL}portugal_data_zstd10.parquet`,
            // `${BASE_URL}romania_data_zstd10.parquet`,
            // `${BASE_URL}serbia_data_zstd10.parquet`,
            // `${BASE_URL}slovakia_data_zstd10.parquet`,
            // `${BASE_URL}slovenia_data_zstd10.parquet`,
            // `${BASE_URL}spain_data_zstd10.parquet`,
            // `${BASE_URL}sweden_data_zstd10.parquet`,
            `${BASE_URL}switzerland_data_zstd10.parquet`,
            `${BASE_URL}turkiye_data_zstd10.parquet`,
            `${BASE_URL}united_kingdom_data_zstd10.parquet`
        ];
    }, []);
};