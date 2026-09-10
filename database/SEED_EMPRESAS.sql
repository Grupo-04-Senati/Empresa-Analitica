INSERT INTO clientes (nombre, email, telefono, empresa, activo, created_at) VALUES
('Carlos Mendoza', 'carlos.mendoza@techcorp.com', '999111222', 'TechCorp Solutions', true, NOW()),
('Maria Garcia', 'maria.garcia@innovaweb.com', '999222333', 'InnovaWeb SAC', true, NOW()),
('Juan Rodriguez', 'juan.rodriguez@datapro.com', '999333444', 'DataPro Analytics', true, NOW()),
('Ana Lopez', 'ana.lopez@cloudsys.com', '999444555', 'CloudSys Peru', true, NOW()),
('Pedro Martinez', 'pedro.martinez@fintech.com', '999555666', 'FinTech Global', true, NOW()),
('Laura Sanchez', 'laura.sanchez@digital.co', '999666777', 'Digital Marketing Co', true, NOW()),
('Roberto Flores', 'roberto.flores@redes.com', '999777888', 'Redes y Telecom', true, NOW()),
('Sofia Torres', 'sofia.torres@ecoenergy.com', '999888999', 'EcoEnergy Solutions', true, NOW()),
('Diego Ramirez', 'diego.ramirez@medtech.com', '999000111', 'MedTech Salud', true, NOW()),
('Camila Vargas', 'camila.vargas@eduonline.com', '999111000', 'EduOnline Academy', true, NOW())
ON CONFLICT (email) DO NOTHING;
