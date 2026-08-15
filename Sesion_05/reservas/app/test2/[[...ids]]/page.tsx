
/**
 * Ruta con Catch-all opcional: "/test2/[[...ids]]"
 * Los dobles corchetes + "..." capturan cero, uno o varios segmentos:
 *   /test2        -> ids = undefined
 *   /test2/1      -> ids = ["1"]
 *   /test2/1/2/3  -> ids = ["1", "2", "3"]
 * Renderizado: Server Component con Dynamic Rendering (depende de params).
 */
interface Test2Props {
  params: { ids: string[] };
}

async function Test2({ params }: Test2Props) {

    const {ids} = await params;

    return ( <>
        <ul>
            {ids && ids.length> 0 ? ids.map((id) => (
                <li key={id}>Hola Usuario Id: {id}</li>
            )): <li>No hay ids</li>}
        </ul>
    </> );
}

export default Test2;