-- =============================================================================
-- Vista previa (solo lectura) de la migración 2026-10-23-telefonos-normalizados
--
-- Muestra cada teléfono distinto y en qué se convertiría. "normalizado" vacío
-- = no se puede normalizar (queda como está y hay que corregirlo a mano).
-- No modifica ningún dato: la función es temporal y desaparece con la sesión.
-- =============================================================================

CREATE OR REPLACE FUNCTION pg_temp.normalizar_telefono_ar(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text := regexp_replace(coalesce(t, ''), '\D', '', 'g');
  cortos text[] := ARRAY['220','221','223','230','236','237','249','260','261','263','264',
    '266','280','291','294','297','298','299','336','341','342','343','345','348','351',
    '353','358','362','364','370','376','379','380','381','383','385','387','388'];
  largo int;
BEGIN
  IF d ~ '^549[0-9]{10}$' THEN RETURN d; END IF;          -- ya normalizado
  IF d ~ '^54[0-9]{10}$' THEN RETURN '549' || substr(d, 3); END IF;  -- 54 sin el 9
  d := regexp_replace(d, '^0+', '');                       -- 0 del área
  IF d ~ '^[0-9]{12}$' THEN                                -- área + 15 + número
    largo := CASE WHEN d LIKE '11%' THEN 2
                  WHEN left(d, 3) = ANY (cortos) THEN 3
                  ELSE 4 END;
    IF substr(d, largo + 1, 2) = '15' THEN
      d := left(d, largo) || substr(d, largo + 3);
    END IF;
  END IF;
  IF d ~ '^[0-9]{10}$' AND d !~ '^15' THEN RETURN '549' || d; END IF;
  RETURN NULL;                                             -- no se puede normalizar
END;
$$;

SELECT tabla, original, pg_temp.normalizar_telefono_ar(original) AS normalizado, cantidad
FROM (
  SELECT 'pedidos' AS tabla, cliente_telefono AS original, count(*) AS cantidad FROM pedidos GROUP BY 2
  UNION ALL
  SELECT 'clientes', telefono, count(*) FROM clientes WHERE telefono IS NOT NULL GROUP BY 2
  UNION ALL
  SELECT 'configuracion_tienda', telefono, 1 FROM configuracion_tienda
) t
ORDER BY tabla, normalizado NULLS FIRST, original;
