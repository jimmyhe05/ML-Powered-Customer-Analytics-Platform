"""Small DataFrame helpers shared by the web app and the data-processing subprocess."""
import numpy as np
import pandas as pd


def collapse_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Merge columns that share a name, keeping the first non-null value per row.

    Column order follows each name's first appearance. This replaces
    ``df.T.groupby(level=0).first().T``, which transposes the whole frame into an
    object array with one column per *row*. That is slow and needs several times the
    frame's memory, so on a full database it stalled requests and exhausted the
    512 MB instance. Here only the duplicated columns are touched, one name at a time.
    """
    if not df.columns.duplicated().any():
        return df

    columns = df.columns.to_numpy()
    series = []
    names = []
    for name in dict.fromkeys(columns.tolist()):
        positions = np.flatnonzero(columns == name)
        if len(positions) == 1:
            series.append(df.iloc[:, positions[0]])
        else:
            values = df.iloc[:, positions].to_numpy(dtype=object)
            present = pd.notna(values)
            first_present = present.argmax(axis=1)  # 0 when the whole row is null
            merged = values[np.arange(len(values)), first_present]
            series.append(pd.Series(merged, index=df.index).infer_objects())
        names.append(name)

    result = pd.concat(series, axis=1)
    result.columns = names
    return result
