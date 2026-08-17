$schemaPath = 'shared/schema.sql'
$rlsPath = 'shared/rls.sql'
$rpcPath = 'shared/rpc.sql'

$schema = Get-Content -Raw $schemaPath
$rls = Get-Content -Raw $rlsPath
$rpc = Get-Content -Raw $rpcPath

$schema = [regex]::Replace(
  $schema,
  "COMMENT ON COLUMN pedidos\.eliminado IS ''Borrado lÃ³gico: true oculta el pedido de la vista normal sin perder su estado ni datos'';\\s*ALTER TABLE pedidos ADD COLUMN usuario_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL;\\s*COMMENT ON COLUMN pedidos\.usuario_id IS ''Nullable: conviven checkout invitado y checkout logueado\. Si el pedido lo crea un cliente autenticado, se guarda su auth\.users\.id; si no, queda NULL\.'';",
  "COMMENT ON COLUMN pedidos.eliminado IS 'Borrado lÃ³gico: true oculta el pedido de la vista normal sin perder su estado ni datos';`r`nALTER TABLE pedidos ADD COLUMN usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;`r`nCOMMENT ON COLUMN pedidos.usuario_id IS 'Nullable: conviven checkout invitado y checkout logueado. Si el pedido lo crea un cliente autenticado, se guarda su auth.users.id; si no, queda NULL.';"
)

$rls = [regex]::Replace(
  $rls,
  'CREATE POLICY "Actualización de pedidos para administradores"\s+  ON pedidos FOR UPDATE\s+  TO authenticated\s+  USING \(public\.is_admin\(\)\)\s+  WITH CHECK \(public\.is_admin\(\)\);\s*-- Nota intencional: anon no tiene SELECT ni DELETE sobre pedidos\.\s*-- Ver sección de aclaraciones al final del archivo\.',
  "CREATE POLICY ""Actualización de pedidos para administradores""`r`n  ON pedidos FOR UPDATE`r`n  TO authenticated`r`n  USING (public.is_admin())`r`n  WITH CHECK (public.is_admin());`r`n`r`nCREATE POLICY ""Lectura de pedidos propios para clientes""`r`n  ON pedidos FOR SELECT`r`n  TO authenticated`r`n  USING (auth.uid() = usuario_id);`r`n`r`n-- Nota intencional: anon no tiene SELECT ni DELETE sobre pedidos.`r`n-- Ver sección de aclaraciones al final del archivo."
)

$rpc = [regex]::Replace(
  $rpc,
  'CREATE OR REPLACE FUNCTION public\.crear_pedido_completo\(\s*p_cliente_nombre text,\s*p_cliente_telefono text,\s*p_cliente_email text,\s*p_items jsonb\s*\)',
  "CREATE OR REPLACE FUNCTION public.crear_pedido_completo(`r`n  p_cliente_nombre text,`r`n  p_cliente_telefono text,`r`n  p_cliente_email text,`r`n  p_items jsonb,`r`n  p_usuario_id uuid DEFAULT NULL`r`n)"
)
$rpc = [regex]::Replace(
  $rpc,
  'INSERT INTO pedidos \(cliente_nombre, cliente_telefono, cliente_email, total\)\s+VALUES \(p_cliente_nombre, p_cliente_telefono, p_cliente_email, v_total\)',
  "INSERT INTO pedidos (cliente_nombre, cliente_telefono, cliente_email, usuario_id, total)`r`n  VALUES (p_cliente_nombre, p_cliente_telefono, p_cliente_email, p_usuario_id, v_total)"
)
$rpc = [regex]::Replace(
  $rpc,
  "'creado_en', creado_en\s*\)",
  "'creado_en', creado_en,`r`n      'usuario_id', usuario_id`r`n    )"
)

Set-Content -Path $schemaPath -Value $schema -Encoding UTF8
Set-Content -Path $rlsPath -Value $rls -Encoding UTF8
Set-Content -Path $rpcPath -Value $rpc -Encoding UTF8
