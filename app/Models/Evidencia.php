class Evidencia extends Model
{
    protected $fillable = [
        'nombre_original',
        'ruta',
        'tipo',
        'tarea_id'
    ];

    public function tarea()
    {
        return $this->belongsTo(Tarea::class);
    }
} 