<!DOCTYPE html>
<html>
<head>
    <title>WorkBoard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #0F6CBD;
            color: white;
            padding: 10px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .logo {
            max-width: 100px;
            height: auto;
            margin-bottom: 5px;
        }
        .content {
            background-color: #f9f9f9;
            padding: 20px;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 5px 5px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            text-transform: capitalize;
        }
        .message {
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #0F6CBD;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Gestion de tareas - WorkBoard</h2>
    </div>
    
    <div class="content">
        <div class="greeting">
            Estimado/a, {{ $data['name'] }}
        </div>
        
        <div class="message">
            Reciba un cordial saludo.
        </div>
        
        <div class="message">
            Queremos informarle que  {{ $data['message'] }}      
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no responder.</p>
        </div>
    </div>
</body>
</html> 