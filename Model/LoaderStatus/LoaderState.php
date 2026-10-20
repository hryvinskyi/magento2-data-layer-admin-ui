<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\LoaderStatus;

/**
 * Whether a scope outputs the Tag Manager loader, and if not, why
 */
enum LoaderState
{
    /**
     * The data layer is off for the scope
     */
    case Disabled;

    /**
     * No container id is set
     */
    case NoContainer;

    /**
     * The stored container id is not one
     */
    case InvalidContainer;

    /**
     * The loader is output
     */
    case Output;
}
