<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Form;

/**
 * How a read-only status line reads at a glance: the colour of its dot, and of the whole line for an error
 */
enum StatusTone: string
{
    /**
     * Working as set up
     */
    case Ok = 'ok';

    /**
     * Not working yet, and the settings say why
     */
    case Attention = 'attention';

    /**
     * Failing
     */
    case Error = 'error';

    /**
     * Switched off, or nothing to show at this scope
     */
    case Muted = 'muted';
}
